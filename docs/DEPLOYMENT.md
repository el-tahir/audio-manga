# Deployment Guide

## Google Cloud Run Deployment

This application is designed to run on Google Cloud Run with automated CI/CD through Google Cloud Build.

### Prerequisites

1. Google Cloud Platform project with billing enabled
2. Required APIs enabled:
   - Cloud Run API
   - Cloud Build API
   - Cloud Storage API
   - Cloud Tasks API
   - Artifact Registry API

### Setup Steps

1. **Configure Artifact Registry:**
   ```bash
   gcloud artifacts repositories create audio-manga-repo \
     --repository-format=docker \
     --location=us-east4
   ```

2. **Set up Cloud Build trigger:**
   - Connect your repository to Cloud Build
   - Configure trigger to use `cloudbuild.yaml`
   - Set up required secrets in Secret Manager

3. **Configure Secret Manager:**
   Required secrets:
   - `NEXT_PUBLIC_SUPABASE_URL_SECRET`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY_SECRET`
   - `POSTGRES_URL_SECRET`
   - `GCP_PROJECT_ID_SECRET`
   - `GCP_CLIENT_EMAIL_SECRET`
   - `GCP_PRIVATE_KEY_BASE64_SECRET`
   - `GOOGLE_CLOUD_BUCKET_NAME_SECRET`
   - `GOOGLE_API_KEY_SECRET`
   - `GCP_QUEUE_LOCATION_SECRET`
   - `GCP_QUEUE_ID_SECRET`
   - `GCP_TASK_HANDLER_URL_SECRET`
   - `GCP_TEMP_UPLOAD_BUCKET_NAME_SECRET`

4. **Create service account:**
   ```bash
   gcloud iam service-accounts create main-app-account \
     --display-name="Main App Service Account"
   ```

5. **Grant necessary permissions:**
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:main-app-account@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:main-app-account@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/cloudtasks.enqueuer"
   ```

### Manual Deployment

If you need to deploy manually:

1. **Build the Docker image:**
   ```bash
   docker build -t audio-manga .
   ```

2. **Tag and push to Artifact Registry:**
   ```bash
   docker tag audio-manga us-east4-docker.pkg.dev/PROJECT_ID/audio-manga-repo/audio-manga:latest
   docker push us-east4-docker.pkg.dev/PROJECT_ID/audio-manga-repo/audio-manga:latest
   ```

3. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy audio-manga-app \
     --image us-east4-docker.pkg.dev/PROJECT_ID/audio-manga-repo/audio-manga:latest \
     --region us-east4 \
     --service-account main-app-account@PROJECT_ID.iam.gserviceaccount.com \
     --set-secrets=[ENV_VARS_FROM_SECRET_MANAGER]
   ```

## Environment-Specific Configurations

### Production
- Enable Cloud Armor for DDoS protection
- Configure custom domain with SSL certificate
- Set up monitoring and alerting
- Configure backup strategies for Cloud Storage

### Staging
- Use separate GCP project or namespace
- Reduced resource allocations
- Test data only

## Monitoring and Logging

- **Cloud Logging:** All application logs are sent to Cloud Logging
- **Cloud Monitoring:** Set up alerts for:
  - High error rates
  - Memory usage
  - Response latency
  - Failed deployments

## Rollback Strategy

To rollback to a previous version:

```bash
gcloud run services update-traffic audio-manga-app \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-east4
```

## Performance Optimization

- **Cold Start Mitigation:** Configure minimum instances for production
- **Resource Allocation:** Adjust CPU and memory based on usage patterns
- **CDN:** Consider Cloud CDN for static assets
- **Database:** Optimize Supabase connection pooling