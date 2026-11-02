# syntax=docker/dockerfile:1

FROM golang:1.27-bookworm AS build
WORKDIR /src/server

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=build /out/api /api
COPY content/scoring/*.json /content/scoring/
COPY content/quests/*-errand.json /content/quests/
ENV ABRAXAS_CONTENT_DIR=/content
EXPOSE 8080
ENTRYPOINT ["/api"]
