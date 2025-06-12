# Deployment Guide

This guide covers various deployment options for the MCP Agent Social Media Server.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
  - [Docker](#docker)
  - [PM2](#pm2)
  - [Systemd](#systemd)
  - [Cloud Platforms](#cloud-platforms)
- [Production Checklist](#production-checklist)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Backup and Recovery](#backup-and-recovery)

## Prerequisites

Before deploying, ensure you have:

1. Built the application:

   ```bash
   npm run build
   ```

2. Set up environment variables (see [CONFIGURATION.md](CONFIGURATION.md))

3. Tested the application:
   ```bash
   npm test
   npm run test:integration
   ```

## Deployment Options

### Docker

Docker provides consistent deployment across environments.

#### Using Dockerfile

1. Build the Docker image:

   ```bash
   docker build -t mcp-agent-social:latest .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name mcp-agent-social \
     -e TEAM_NAME=my-team \
     -e SOCIAL_API_BASE_URL=https://api.example.com \
     -e SOCIAL_API_KEY=your-api-key \
     -e LOG_LEVEL=INFO \
     --restart unless-stopped \
     mcp-agent-social:latest
   ```

#### Using Docker Compose

1. Start services:

   ```bash
   docker-compose up -d
   ```

2. View logs:

   ```bash
   docker-compose logs -f agent-social
   ```

3. Stop services:
   ```bash
   docker-compose down
   ```

#### Docker Deployment Best Practices

- Use specific version tags instead of `latest`
- Implement health checks
- Use secrets management for API keys
- Set resource limits

Example production docker-compose.yml:

```yaml
version: '3.8'

services:
  agent-social:
    image: mcp-agent-social:1.0.3
    restart: unless-stopped
    environment:
      TEAM_NAME: ${TEAM_NAME}
      SOCIAL_API_BASE_URL: ${SOCIAL_API_BASE_URL}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      NODE_ENV: production
    secrets:
      - api_key
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ['CMD', 'node', 'healthcheck.js']
      interval: 30s
      timeout: 10s
      retries: 3

secrets:
  api_key:
    external: true
```

### PM2

PM2 is a production process manager for Node.js applications.

#### Installation

```bash
npm install -g pm2
```

#### Basic Deployment

1. Create ecosystem file `ecosystem.config.js`:

   ```javascript
   module.exports = {
     apps: [
       {
         name: 'mcp-agent-social',
         script: './build/index.js',
         instances: 1,
         exec_mode: 'fork',
         env: {
           NODE_ENV: 'production',
           TEAM_NAME: 'my-team',
           SOCIAL_API_BASE_URL: 'https://api.example.com',
           SOCIAL_API_KEY: process.env.SOCIAL_API_KEY,
           LOG_LEVEL: 'INFO',
         },
         error_file: './logs/error.log',
         out_file: './logs/out.log',
         log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
         max_memory_restart: '1G',
       },
     ],
   };
   ```

2. Start the application:

   ```bash
   pm2 start ecosystem.config.js
   ```

3. Save PM2 configuration:
   ```bash
   pm2 save
   pm2 startup
   ```

#### PM2 Commands

```bash
# Status
pm2 status

# Logs
pm2 logs mcp-agent-social

# Restart
pm2 restart mcp-agent-social

# Stop
pm2 stop mcp-agent-social

# Monitor
pm2 monit
```

#### PM2 Cluster Mode

For better performance on multi-core systems:

```javascript
{
  instances: 'max',  // or specific number
  exec_mode: 'cluster'
}
```

### Systemd

For Linux systems, systemd provides native process management.

#### Create Service File

Create `/etc/systemd/system/mcp-agent-social.service`:

```ini
[Unit]
Description=MCP Agent Social Media Server
After=network.target

[Service]
Type=simple
User=nodeapp
WorkingDirectory=/opt/mcp-agent-social
ExecStart=/usr/bin/node /opt/mcp-agent-social/build/index.js
Restart=on-failure
RestartSec=10

# Environment
Environment="NODE_ENV=production"
Environment="TEAM_NAME=my-team"
Environment="SOCIAL_API_BASE_URL=https://api.example.com"
Environment="LOG_LEVEL=INFO"
EnvironmentFile=/opt/mcp-agent-social/.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/mcp-agent-social/logs

# Resource Limits
LimitNOFILE=65536
MemoryLimit=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

#### Manage Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable mcp-agent-social

# Start service
sudo systemctl start mcp-agent-social

# Check status
sudo systemctl status mcp-agent-social

# View logs
sudo journalctl -u mcp-agent-social -f
```

### Cloud Platforms

#### AWS ECS

1. Create task definition:

   ```json
   {
     "family": "mcp-agent-social",
     "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
     "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
     "networkMode": "awsvpc",
     "containerDefinitions": [
       {
         "name": "mcp-agent-social",
         "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/mcp-agent-social:latest",
         "memory": 2048,
         "cpu": 1024,
         "essential": true,
         "environment": [
           { "name": "TEAM_NAME", "value": "my-team" },
           { "name": "SOCIAL_API_BASE_URL", "value": "https://api.example.com" },
           { "name": "LOG_LEVEL", "value": "INFO" }
         ],
         "secrets": [
           {
             "name": "SOCIAL_API_KEY",
             "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:mcp-api-key"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/mcp-agent-social",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

2. Create service with auto-scaling

#### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT-ID/mcp-agent-social

# Deploy
gcloud run deploy mcp-agent-social \
  --image gcr.io/PROJECT-ID/mcp-agent-social \
  --platform managed \
  --region us-central1 \
  --set-env-vars TEAM_NAME=my-team \
  --set-env-vars SOCIAL_API_BASE_URL=https://api.example.com \
  --set-secrets SOCIAL_API_KEY=mcp-api-key:latest \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 1
```

#### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-agent-social
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-agent-social
  template:
    metadata:
      labels:
        app: mcp-agent-social
    spec:
      containers:
        - name: mcp-agent-social
          image: mcp-agent-social:1.0.3
          ports:
            - containerPort: 3000
          env:
            - name: TEAM_NAME
              value: 'my-team'
            - name: SOCIAL_API_BASE_URL
              value: 'https://api.example.com'
            - name: SOCIAL_API_KEY
              valueFrom:
                secretKeyRef:
                  name: mcp-secrets
                  key: api-key
          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '2Gi'
              cpu: '2000m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

## Production Checklist

### Before Deployment

- [ ] Run full test suite
- [ ] Update version numbers
- [ ] Review security configurations
- [ ] Set up monitoring and alerting
- [ ] Configure backup procedures
- [ ] Document deployment procedures
- [ ] Create rollback plan

### Environment Configuration

- [ ] Use production API endpoints
- [ ] Set appropriate log levels
- [ ] Configure proper timeouts
- [ ] Enable security features
- [ ] Set up SSL/TLS if needed

### Security

- [ ] Store secrets securely (not in code)
- [ ] Implement rate limiting
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Regular security updates

### Performance

- [ ] Enable production optimizations
- [ ] Configure connection pooling
- [ ] Set up caching if needed
- [ ] Monitor resource usage

## Monitoring

### Health Checks

Implement health check endpoint:

```javascript
// healthcheck.js
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  process.exit(res.statusCode === 200 ? 0 : 1);
});

request.on('error', () => {
  console.log('ERROR');
  process.exit(1);
});

request.end();
```

### Metrics Collection

Use tools like:

- **Prometheus** + Grafana
- **DataDog**
- **New Relic**
- **CloudWatch** (AWS)
- **Stackdriver** (GCP)

Example Prometheus metrics:

```javascript
// Instrument your code
const promClient = require('prom-client');
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});
```

### Logging

Centralize logs using:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **CloudWatch Logs**
- **Stackdriver Logging**

## Scaling

### Horizontal Scaling

1. **Load Balancing**

   - Use reverse proxy (Nginx, HAProxy)
   - Cloud load balancers (ALB, GCP Load Balancer)

2. **Session Management**

   - Consider external session store for multi-instance
   - Redis for distributed sessions

3. **API Rate Limiting**
   - Implement per-instance limits
   - Use distributed rate limiting

### Vertical Scaling

Monitor and adjust:

- Memory allocation
- CPU limits
- Connection pool sizes
- Cache sizes

## Backup and Recovery

### Data Backup

Since the application uses external API:

- No local data persistence needed
- Focus on configuration backup

### Configuration Backup

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mcp-agent-social"

# Create backup
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  .env \
  ecosystem.config.js \
  docker-compose.yml \
  /etc/systemd/system/mcp-agent-social.service

# Keep last 30 days
find "$BACKUP_DIR" -name "config_*.tar.gz" -mtime +30 -delete
```

### Disaster Recovery

1. **Documentation**

   - Keep deployment procedures updated
   - Document all configurations
   - Maintain contact lists

2. **Recovery Testing**

   - Regular disaster recovery drills
   - Test backup restoration
   - Validate rollback procedures

3. **RTO/RPO Targets**
   - Define Recovery Time Objective
   - Define Recovery Point Objective
   - Plan accordingly
