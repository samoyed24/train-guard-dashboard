FROM golang:1.25.8-alpine AS build

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN go mod tidy && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /train-guard-worker .

FROM alpine:3.20

WORKDIR /app

COPY --from=build /train-guard-worker /usr/local/bin/train-guard-worker

CMD ["train-guard-worker"]
