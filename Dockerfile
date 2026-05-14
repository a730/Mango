FROM crystallang/crystal:1.16.3-alpine AS builder

WORKDIR /Mango

COPY . .
RUN apk add --no-cache yarn yaml-static sqlite-static libarchive-dev libarchive-static acl-static expat-static zstd-static lz4-static bzip2-static libjpeg-turbo-dev libpng-dev tiff-dev
RUN yarn && yarn uglify
RUN shards install
RUN crystal build src/mango.cr --release --progress

FROM library/alpine

RUN adduser -D mango
WORKDIR /home/mango

COPY --from=builder /Mango/mango /usr/local/bin/mango

USER mango

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:9000/ > /dev/null || exit 1

EXPOSE 9000

CMD ["/usr/local/bin/mango"]
