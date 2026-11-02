package httpapi

import (
	"context"
	"errors"

	"firebase.google.com/go/v4/appcheck"
	"firebase.google.com/go/v4/auth"
)

type FirebaseAuth struct{ Client *auth.Client }

func (v FirebaseAuth) VerifyIDToken(ctx context.Context, token string) (string, error) {
	verified, err := v.Client.VerifyIDToken(ctx, token)
	if err != nil {
		return "", err
	}
	if !idPattern.MatchString(verified.UID) {
		return "", errors.New("invalid uid")
	}
	return verified.UID, nil
}

type FirebaseAppCheck struct{ Client *appcheck.Client }

func (v FirebaseAppCheck) VerifyAppCheck(ctx context.Context, token string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	_, err := v.Client.VerifyToken(token)
	return err
}
