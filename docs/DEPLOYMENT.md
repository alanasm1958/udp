# UDP Production Deployment Guide

This guide covers deploying UDP to a VPS (Ubuntu 22.04+) like Hostinger, DigitalOcean, or Linode.

## Prerequisites

- Ubuntu 22.04+ VPS with SSH access
- Domain name pointed to your server IP
- At least 1GB RAM, 20GB disk

## Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Log out and back in to apply docker group
exit
```

## Clone and Configure

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/udp.git
cd udp

# Copy and configure production environment
cp .env.prod.example .env.prod
nano .env.prod
```

### Required .env.prod values:

```bash
# Your domain (without https://)
DOMAIN=your-domain.com

# Generate strong password
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# Generate session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Update DATABASE_URL with your POSTGRES_PASSWORD
DATABASE_URL=postgres://udp:YOUR_PASSWORD@db:5432/udp
```

## Deploy

```bash
# Run deploy script
./scripts/deploy/deploy.sh
```

This will:
1. Pull latest code
2. Build Docker images
3. Run database migrations
4. Start all services (app, postgres, caddy)

## Verify Deployment

```bash
# Check services
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Test endpoint
curl https://your-domain.com/api/auth/bootstrap
```

## SSL/TLS

Caddy automatically provisions and renews Let's Encrypt certificates.
Just ensure:
- Port 80 and 443 are open in your firewall
- Your domain DNS points to the server IP

## Daily Backups

Set up automated backups with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/udp/scripts/deploy/backup.sh >> /var/log/udp-backup.log 2>&1
```

## Manual Backup

```bash
./scripts/deploy/backup.sh
```

Backups are stored in `./backups/` with 7-day retention by default.

## Updates

```bash
./scripts/deploy/deploy.sh
```

## Troubleshooting

### App not starting
```bash
docker compose -f docker-compose.prod.yml logs app
```

### Database issues
```bash
docker compose -f docker-compose.prod.yml exec db psql -U udp -d udp
```

### Restart services
```bash
docker compose -f docker-compose.prod.yml restart
```

### Full rebuild
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

## Firewall (UFW)

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```
