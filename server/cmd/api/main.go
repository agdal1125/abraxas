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

	httpapi "github.com/agdal1125/abraxas/server/internal/http"
	"github.com/agdal1125/abraxas/server/internal/play"
	"github.com/agdal1125/abraxas/server/internal/store"
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
		Handler:           httpapi.NewPlayRouter(logger, httpapi.PlayConfig{Store: store.NewMemory(), Engine: engine, Auth: verifier, AllowMissingAppCheck: skipAppCheck}),
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
