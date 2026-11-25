- old install: 14 manual steps (Postgres, Redis, object storage, 6 env files, migrations by hand), our own docs said "allow a day"
- new: `helm install` with one values file; the chart runs migrations as a job and checks the cluster before it starts
- preflight tells you what's missing (storage class, ingress, a Postgres it can't reach) before anything is installed
- airgapped: images can come from your own registry, set one value
- tested on EKS, GKE, AKS and k3s
- Priya on our platform team ran it on a fresh cluster and wrote this in Slack, quote it exactly (her message, as she typed it):

  Fresh cluster to first trace in 18 minutes — and I didn't open the docs once.
- upgrade is `helm upgrade`, the chart runs new migrations before the new pods take traffic
