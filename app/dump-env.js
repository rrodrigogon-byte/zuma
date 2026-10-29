export function addDumpEnv(app) {
  app.use((req, res, next) => {
    if (req.path === '/dump') {
      res.json({
        gcp: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        gcp_email: process.env.GCP_CLIENT_EMAIL,
        gcp_pk: process.env.GCP_PRIVATE_KEY
      });
      return;
    }
    next();
  });
}
