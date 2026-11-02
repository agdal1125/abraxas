package store

import (
	"context"
	"encoding/json"
	"errors"

	"cloud.google.com/go/firestore"
	"github.com/agdal1125/abraxas/server/internal/play"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Firestore struct{ client *firestore.Client }

func NewFirestore(client *firestore.Client) *Firestore { return &Firestore{client: client} }

func decodeFirestore(snapshot *firestore.DocumentSnapshot) (play.Doc, error) {
	if !snapshot.Exists() {
		return play.Doc{}, ErrNotFound
	}
	data, ok := snapshot.Data()["data"].([]byte)
	if !ok {
		return play.Doc{}, errors.New("invalid stored play")
	}
	var doc play.Doc
	if err := json.Unmarshal(data, &doc); err != nil {
		return play.Doc{}, err
	}
	return doc, nil
}
func firestoreData(doc play.Doc) (map[string]interface{}, error) {
	data, err := json.Marshal(doc)
	return map[string]interface{}{"data": data}, err
}
func (s *Firestore) player(uid string) *firestore.DocumentRef {
	return s.client.Collection("players").Doc(uid)
}
func (s *Firestore) play(uid, id string) *firestore.DocumentRef {
	return s.player(uid).Collection("plays").Doc(id)
}
func (s *Firestore) Get(ctx context.Context, uid, id string) (play.Doc, error) {
	snap, err := s.play(uid, id).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return play.Doc{}, ErrNotFound
	}
	if err != nil {
		return play.Doc{}, err
	}
	return decodeFirestore(snap)
}
func (s *Firestore) Current(ctx context.Context, uid string) (play.Doc, error) {
	snap, err := s.player(uid).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return play.Doc{}, ErrNotFound
	}
	if err != nil {
		return play.Doc{}, err
	}
	id, ok := snap.Data()["currentPlayId"].(string)
	if !ok || id == "" {
		return play.Doc{}, ErrNotFound
	}
	return s.Get(ctx, uid, id)
}
func (s *Firestore) Create(ctx context.Context, uid, key string, doc play.Doc) (play.Doc, bool, error) {
	player := s.player(uid)
	var result play.Doc
	var created bool
	err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		created = false
		p, err := tx.Get(player)
		if err != nil && status.Code(err) != codes.NotFound {
			return err
		}
		if err == nil && p.Exists() {
			id, ok := p.Data()["currentPlayId"].(string)
			if !ok || id == "" {
				return errors.New("invalid player")
			}
			current, err := tx.Get(s.play(uid, id))
			if err != nil {
				return err
			}
			result, err = decodeFirestore(current)
			if err != nil {
				return err
			}
			create, err := tx.Get(player.Collection("creates").Doc(key))
			if err != nil && status.Code(err) != codes.NotFound {
				return err
			}
			if result.Snapshot.Segment == "result" && (err != nil || !create.Exists()) {
				return ErrReplay
			}
			return tx.Set(player.Collection("creates").Doc(key), map[string]interface{}{"playId": id})
		}
		data, err := firestoreData(doc)
		if err != nil {
			return err
		}
		if err = tx.Set(s.play(uid, doc.Snapshot.PlayID), data); err != nil {
			return err
		}
		if err = tx.Set(player, map[string]interface{}{"currentPlayId": doc.Snapshot.PlayID}); err != nil {
			return err
		}
		if err = tx.Set(player.Collection("creates").Doc(key), map[string]interface{}{"playId": doc.Snapshot.PlayID}); err != nil {
			return err
		}
		result, created = copyDoc(doc), true
		return nil
	})
	if err != nil {
		return play.Doc{}, false, err
	}
	return result, created, nil
}
func (s *Firestore) Update(ctx context.Context, uid, id string, fn func(*play.Doc) error) (play.Doc, error) {
	ref := s.play(uid, id)
	var result play.Doc
	err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		if status.Code(err) == codes.NotFound {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		doc, err := decodeFirestore(snap)
		if err != nil {
			return err
		}
		before := copyDoc(doc)
		if err = fn(&doc); err != nil {
			return err
		}
		data, err := firestoreData(doc)
		if err != nil {
			return err
		}
		if err = tx.Set(ref, data); err != nil {
			return err
		}
		for key, receipt := range doc.Receipts {
			if _, exists := before.Receipts[key]; exists {
				continue
			}
			data, err := json.Marshal(receipt)
			if err != nil {
				return err
			}
			if err = tx.Set(ref.Collection("commands").Doc(key), map[string]interface{}{"data": data}); err != nil {
				return err
			}
		}
		for key, value := range doc.Events {
			if value && !before.Events[key] {
				if err = tx.Set(ref.Collection("events").Doc(key), map[string]interface{}{"completed": true}); err != nil {
					return err
				}
			}
		}
		result = copyDoc(doc)
		return nil
	})
	if err != nil {
		return play.Doc{}, err
	}
	return result, nil
}
