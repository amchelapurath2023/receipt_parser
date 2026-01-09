FROM golang:1.24.0

WORKDIR /usr/src/app

RUN go install github.com/air-verse/air@1.61.1

COPY . . 

RUN go mod tidy

