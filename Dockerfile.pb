# PocketBase — backend KryMark (SQLite, auth, rules đa-tenant). Internal-only, không expose public.
FROM alpine:3.20
ARG PB_VERSION=0.39.7
RUN apk add --no-cache ca-certificates curl unzip \
  && curl -fsSL -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fs http://127.0.0.1:8090/api/health || exit 1
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks"]
