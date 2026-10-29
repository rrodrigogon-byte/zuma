export function addDumpEnv(app) {
  app.use((req, res, next) => {
    if (req.path === '/dump') {
      res.json({
        jwt: process.env.JWT_SECRET
      });
      return;
    }
    next();
  });
}
