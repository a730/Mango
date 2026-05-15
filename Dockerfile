FROM crystallang/crystal:1.16.3-alpine AS builder

WORKDIR /Mango

COPY . .

RUN apk add --no-cache yaml-static sqlite-static libarchive-dev libarchive-static \
  acl-static expat-static zstd-static lz4-static bzip2-static \
  libjpeg-turbo-dev libpng-dev tiff-dev gcc make musl-dev curl

# Build vendored image_size native extensions
RUN cd lib/image_size && make

# Install Crystal dependencies
RUN shards install

# Build Mango binary
RUN crystal build src/mango.cr --release --progress

FROM alpine:3.21

RUN adduser -D mango
WORKDIR /home/mango

COPY --from=builder /Mango/mango /usr/local/bin/mango

USER mango

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:9000/ > /dev/null || exit 1

EXPOSE 9000

CMD ["/usr/local/bin/mango"]
