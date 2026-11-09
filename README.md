# faculty.management.system



db

podman run -d \
    --name faculty-postgres \
    -e POSTGRES_USER=faculty \
    -e POSTGRES_PASSWORD=faculty_dev_password \
    -e POSTGRES_DB=faculty_db \
    -p 127.0.0.1:5432:5432 \
    -v faculty-postgres-data:/var/lib/postgresql/data \
    docker.io/library/postgres:17
  
