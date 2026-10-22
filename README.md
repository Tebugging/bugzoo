# 🐞 Bug Zoo

[![GitHub stars](https://img.shields.io/github/stars/Tebugging/bugzoo?style=social)](https://github.com/Tebugging/bugzoo/stargazers)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Made by Tebugging](https://img.shields.io/badge/made%20by-Tebugging-2f6f4f.svg)](https://tebugging.com)

Bug Zoo is a public practice playground for software testing. It is a small,
realistic web shop with **planted functional bugs**. Use it to practise
exploratory testing, to try out QA tools, or to measure how well an AI testing
agent finds real bugs.

Bug Zoo is a [Tebugging](https://tebugging.com) product, made for testing
purposes. Tebugging uses it to train and evaluate its AI QA agents, and it is
hosted at **bugzoo.dev**.

Bug Zoo is **open source** under the Apache-2.0 license. You are free to run
it, self-host it, change it and use it in your own testing work. If it helps
you, a ⭐ on GitHub is welcome.

The bugs are not listed here on purpose. Finding them is the game.

> **Fake shop.** Payments are fake. Never enter a real card number. Use the test
> card `4242 4242 4242 4242`, any future expiry (MM/YY) and any 3-digit CVC.

## What is in the shop

- Product list with sorting and pagination
- Product pages
- Search
- Cart with quantities and discount codes
- Checkout with a fake payment step
- Sign up, log in, log out
- Order history

Demo accounts (public on purpose):

| Email | Password |
|-------|----------|
| `alice@bugzoo.dev` | `bugzoo-alice` |
| `bob@bugzoo.dev` | `bugzoo-bob` |

All data lives in memory and goes back to the seed data on every restart.

## Run it locally

You need **Node.js 22 or newer**. There are no npm dependencies, so there is
nothing to install.

```bash
npm start
```

Open <http://localhost:8080>.

Or with Docker:

```bash
docker compose up --build
```

## Modes: practice and clean

The `BUGZOO_BUGS` setting turns the planted bugs on or off:

| Value | Meaning |
|-------|---------|
| `all` (default) | Practice mode: every planted bug is on |
| `none` | Clean mode: no planted bugs, for comparison runs |
| `B01,B04` | Only the listed bugs are on |

```bash
npm run start:clean          # clean mode on :8080
BUGZOO_BUGS=none PORT=8081 npm start
```

With Docker, run a clean shop on port 8081 next to the practice shop:

```bash
docker compose --profile clean up -d --build
```

The footer and `GET /healthz` show the current mode.

## Tests

```bash
npm test
```

The tests boot the app in both modes and walk through the main shopping flow in
clean mode (browse, search, cart, checkout, order history, sign up).

## Self-hosting

Bug Zoo is one small container (about 25 MB of RAM when idle). It is built to
share a small server with other sites without affecting them:

| Risk to other sites | How Bug Zoo prevents it |
|---------------------|-------------------------|
| Uses too much CPU or RAM | Hard caps: 0.25 CPU, 128 MB RAM, 64 processes. Under load it slows itself down, not the host |
| Host runs out of memory | Raised OOM score: the kernel kills Bug Zoo first, not your other sites |
| Fills the disk | No volumes, read-only file system, logs rotated at 3 × 1 MB, data only in RAM |
| Port clash | Binds to `127.0.0.1` only. If the port is taken, Docker refuses to start Bug Zoo; the other site keeps running |
| Commands hit other containers | Fixed compose project name `bugzoo`; `reset.sh` only restarts that project |
| Network access to other containers | Runs in its own Docker network |

### Steps

1. Copy the repo to the server, for example to `/opt/bugzoo`.
2. Run the read-only pre-flight check. It changes nothing; it checks ports,
   memory, disk and which web proxy you run:

   ```bash
   cd /opt/bugzoo && sh scripts/preflight.sh
   ```

   If port 8080 is taken, put `BUGZOO_PORT=18080` (any free port) in a `.env`
   file next to `docker-compose.yml`.
3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Add a site to your reverse proxy. Add a **new** site block; do not edit the
   other sites. Check the config before you reload so a typo cannot take the
   other sites down.

   Caddy:

   ```
   bugzoo.example.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   Then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`.

   nginx: add a new file in `sites-available`/`conf.d` with
   `proxy_pass http://127.0.0.1:8080;`, then `nginx -t && systemctl reload nginx`.

   If your proxy runs **inside Docker** (Traefik, Dokploy, Coolify, Nginx Proxy
   Manager), it cannot reach `127.0.0.1` on the host. The pre-flight check
   tells you. In that case, deploy Bug Zoo as an app in that tool (it is a
   normal Dockerfile app on port 8080), or attach the `shop` service to the
   proxy's Docker network.

5. Reset the data every night. A restart is a full reset, and
   `scripts/reset.sh` restarts only the Bug Zoo containers. Add it to the
   server's crontab (`crontab -e`), for example at 04:00:

   ```
   0 4 * * * /opt/bugzoo/scripts/reset.sh >> /var/log/bugzoo-reset.log 2>&1
   ```

6. Check it: `curl -s 127.0.0.1:8080/healthz` and open your domain.

To remove Bug Zoo completely: `docker compose -p bugzoo down --rmi local`,
remove the proxy site block and the cron line.

### Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `BUGZOO_BUGS` | `all` | Which planted bugs are on (see above) |
| `PORT` | `8080` | Port inside the process / container |
| `HOST` | `0.0.0.0` | Address to listen on |
| `BUGZOO_PORT` | `8080` | Host port for the compose `shop` service |
| `BUGZOO_CLEAN_PORT` | `8081` | Host port for the compose `shop-clean` service |

To protect a shared server, the app also caps in-memory data (users, orders
and sessions) until the next reset.

## Using Bug Zoo to evaluate testing agents

- Give the agent under test only the shop URL, not this repository. The source
  code shows where the bugs are.
- Run the same task against practice mode and clean mode. Findings in clean
  mode are false positives.
- The answer key is kept private so agents cannot learn it. It is not in this
  repository.

## Contributing

Issues and pull requests are welcome at
<https://github.com/Tebugging/bugzoo>. Please do not post lists of the
planted bugs in public issues: it spoils the game for everyone.

## License

Open source under the [Apache License 2.0](LICENSE).
Made by [Tebugging](https://tebugging.com).
