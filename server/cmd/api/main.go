package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	httpapi "github.com/agdal1125/abraxas/server/internal/http"
	"github.com/agdal1125/abraxas/server/internal/play"
	"github.com/agdal1125/abraxas/server/internal/store"
	"google.golang.org/api/option"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := os.Getenv("ABRAXAS_BIND_ADDR")
	if addr == "" {
		addr = ":" + port
	}
	fake := os.Getenv("ABRAXAS_DEV_FAKE_AUTH") == "1"
	skipAppCheck := os.Getenv("ABRAXAS_DEV_SKIP_APP_CHECK") == "1"
	verifier, err := httpapi.DevelopmentVerifier(fake || skipAppCheck, addr)
	if err != nil {
		logger.Error("invalid development configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}
	if !fake {
		verifier = nil
	}
	var storage store.Store = store.NewMemory()
	var appCheck httpapi.AppCheckVerifier
	mode := os.Getenv("ABRAXAS_STORE")
	if mode == "" {
		mode = "memory"
	}
	if mode != "memory" && mode != "firestore" {
		logger.Error("invalid store configuration")
		os.Exit(1)
	}
	if os.Getenv("FIRESTORE_EMULATOR_HOST") != "" || os.Getenv("FIREBASE_AUTH_EMULATOR_HOST") != "" {
		if _, err := httpapi.DevelopmentVerifier(true, addr); err != nil {
			logger.Error("emulators require loopback", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}
	if mode == "firestore" || !fake {
		project := os.Getenv("GOOGLE_CLOUD_PROJECT")
		if project == "" {
			logger.Error("GOOGLE_CLOUD_PROJECT is required")
			os.Exit(1)
		}
		var opts []option.ClientOption
		if os.Getenv("FIRESTORE_EMULATOR_HOST") != "" && os.Getenv("FIREBASE_AUTH_EMULATOR_HOST") != "" {
			opts = append(opts, option.WithoutAuthentication())
		}
		app, err := firebase.NewApp(context.Background(), &firebase.Config{ProjectID: project}, opts...)
		if err != nil {
			logger.Error("firebase unavailable", slog.String("error", err.Error()))
			os.Exit(1)
		}
		if mode == "firestore" {
			client, err := app.Firestore(context.Background())
			if err != nil {
				logger.Error("firestore unavailable", slog.String("error", err.Error()))
				os.Exit(1)
			}
			defer client.Close()
			storage = store.NewFirestore(client)
		}
		if !fake {
			client, err := app.Auth(context.Background())
			if err != nil {
				logger.Error("firebase auth unavailable", slog.String("error", err.Error()))
				os.Exit(1)
			}
			verifier = httpapi.FirebaseAuth{Client: client}
		}
		if !skipAppCheck {
			client, err := app.AppCheck(context.Background())
			if err != nil {
				logger.Error("app check unavailable", slog.String("error", err.Error()))
				os.Exit(1)
			}
			appCheck = httpapi.FirebaseAppCheck{Client: client}
		}
	}
	root := os.Getenv("ABRAXAS_CONTENT_DIR")
	if root == "" {
		root = "../content"
	}
	engine, err := play.Load(root, os.Getenv("ABRAXAS_CONTENT_VERSION"))
	if err != nil {
		logger.Error("content unavailable", slog.String("error", err.Error()))
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewPlayRouter(logger, httpapi.PlayConfig{Store: storage, Engine: engine, Auth: verifier, AppCheck: appCheck, AllowMissingAppCheck: skipAppCheck}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting server", slog.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		if err != nil {
			logger.Error("server exited with error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	case <-ctx.Done():
		stop()
		logger.Info("shutting down server")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		logger.Info("server stopped cleanly")
	}
}
