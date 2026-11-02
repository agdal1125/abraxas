package store

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"strings"
	"testing"

	"cloud.google.com/go/firestore"
	pb "cloud.google.com/go/firestore/apiv1/firestorepb"
	"github.com/agdal1125/abraxas/server/internal/play"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type fakeTransactions struct {
	pb.UnimplementedFirestoreServer
	docs    map[string]*pb.Document
	commits int
	writes  []int
	fail    bool
}

func (f *fakeTransactions) BeginTransaction(context.Context, *pb.BeginTransactionRequest) (*pb.BeginTransactionResponse, error) {
	return &pb.BeginTransactionResponse{Transaction: []byte("transaction")}, nil
}
func (f *fakeTransactions) BatchGetDocuments(req *pb.BatchGetDocumentsRequest, stream pb.Firestore_BatchGetDocumentsServer) error {
	for _, name := range req.Documents {
		r := &pb.BatchGetDocumentsResponse{ReadTime: timestamppb.Now()}
		if doc := f.docs[name]; doc != nil {
			r.Result = &pb.BatchGetDocumentsResponse_Found{Found: doc}
		} else {
			r.Result = &pb.BatchGetDocumentsResponse_Missing{Missing: name}
		}
		if err := stream.Send(r); err != nil {
			return err
		}
	}
	return nil
}
func (f *fakeTransactions) Commit(_ context.Context, req *pb.CommitRequest) (*pb.CommitResponse, error) {
	f.commits++
	f.writes = append(f.writes, len(req.Writes))
	if f.fail {
		return nil, status.Error(codes.Internal, "commit failed")
	}
	if f.commits == 1 {
		return nil, status.Error(codes.Aborted, "retry")
	}
	for _, w := range req.Writes {
		if doc := w.GetUpdate(); doc != nil {
			doc.CreateTime = timestamppb.Now()
			doc.UpdateTime = timestamppb.Now()
			f.docs[doc.Name] = doc
		}
	}
	return &pb.CommitResponse{CommitTime: timestamppb.Now()}, nil
}
func (f *fakeTransactions) Rollback(context.Context, *pb.RollbackRequest) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func TestFirestoreTransactionRetryAndAtomicWrites(t *testing.T) {
	ctx := context.Background()
	listener := bufconn.Listen(1024 * 1024)
	fake := &fakeTransactions{docs: map[string]*pb.Document{}}
	server := grpc.NewServer()
	pb.RegisterFirestoreServer(server, fake)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient("passthrough:///fake", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	client, err := firestore.NewClient(ctx, "demo-abraxas", option.WithGRPCConn(conn))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	s := NewFirestore(client)
	ref := s.play("user", "play")
	doc := play.NewDoc(play.NewSnapshot("play", "version"))
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	fake.docs[ref.Path] = &pb.Document{Name: ref.Path, CreateTime: timestamppb.Now(), UpdateTime: timestamppb.Now(), Fields: map[string]*pb.Value{"data": {ValueType: &pb.Value_BytesValue{BytesValue: data}}}}
	calls := 0
	apply := func(d *play.Doc) error {
		calls++
		if _, exists := d.Receipts["command"]; exists {
			return nil
		}
		d.Snapshot.Revision++
		d.Events["completed"] = true
		d.Receipts["command"] = play.StoredReceipt{Receipt: play.Receipt{Key: "command", AppliedRevision: d.Snapshot.Revision}}
		return nil
	}
	result, err := s.Update(ctx, "user", "play", apply)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || result.Snapshot.Revision != 1 || fake.commits != 2 || len(fake.writes) != 2 || fake.writes[0] != 3 || fake.writes[1] != 3 || len(fake.docs) != 3 {
		t.Fatalf("retry: calls=%d commits=%d writes=%v documents=%d revision=%d", calls, fake.commits, fake.writes, len(fake.docs), result.Snapshot.Revision)
	}
	var saved play.Doc
	if err := json.Unmarshal(fake.docs[ref.Path].Fields["data"].GetBytesValue(), &saved); err != nil || saved.Snapshot.Revision != 1 || !saved.Events["completed"] || saved.Receipts["command"].Receipt.AppliedRevision != 1 {
		t.Fatalf("saved state: %+v %v", saved, err)
	}
	for _, suffix := range []string{"/commands/command", "/events/completed"} {
		found := false
		for path := range fake.docs {
			if strings.HasSuffix(path, suffix) {
				found = true
			}
		}
		if !found {
			t.Fatalf("missing atomic write %s", suffix)
		}
	}
	retry, err := s.Update(ctx, "user", "play", apply)
	if err != nil || retry.Snapshot.Revision != 1 || len(retry.Receipts) != 1 || fake.writes[2] != 1 {
		t.Fatalf("receipt reuse: %+v %v writes=%v", retry, err, fake.writes)
	}
	stop := errors.New("stop")
	_, err = s.Update(ctx, "user", "play", func(d *play.Doc) error { d.Snapshot.Revision++; return stop })
	if !errors.Is(err, stop) || fake.commits != 3 {
		t.Fatalf("failed transaction committed: %v, commits=%d", err, fake.commits)
	}
	var after play.Doc
	if err := json.Unmarshal(fake.docs[ref.Path].Fields["data"].GetBytesValue(), &after); err != nil || after.Snapshot.Revision != 1 {
		t.Fatalf("rollback changed saved state: %+v %v", after, err)
	}
	fake.fail = true
	_, err = s.Update(ctx, "user", "play", func(d *play.Doc) error {
		d.Snapshot.Revision++
		d.Events["other"] = true
		d.Receipts["other"] = play.StoredReceipt{Receipt: play.Receipt{Key: "other"}}
		return nil
	})
	if status.Code(err) != codes.Internal || len(fake.docs) != 3 {
		t.Fatalf("failed commit changed documents: %v, count=%d", err, len(fake.docs))
	}
	if err := json.Unmarshal(fake.docs[ref.Path].Fields["data"].GetBytesValue(), &after); err != nil || after.Snapshot.Revision != 1 || after.Events["other"] {
		t.Fatalf("failed commit changed state: %+v %v", after, err)
	}
}
