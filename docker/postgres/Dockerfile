FROM postgis/postgis:16-3.4

# pg_h3 is in the pgdg apt repo — already configured in the base image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-h3 \
    && rm -rf /var/lib/apt/lists/*
