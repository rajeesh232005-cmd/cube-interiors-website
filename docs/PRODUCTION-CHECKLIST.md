# Production readiness check

Reviewed: 2026-11-19

This is a static company website served by Cloudflare Pages. It has no database,
user accounts, sessions, uploads, paid API, or private application server. Controls
that only apply to those systems are intentionally marked not applicable rather
than being added as unnecessary complexity.

## Ready for launch

- Cloudflare provides load balancing at the edge, rate limiting/DDoS protection,
  the CDN, reverse proxying, horizontal scaling, HTTPS/TLS, caching, health at the
  hosting layer, and graceful deploys. This covers checklist items 1, 2, 14, 15,
  22, 27, 46, 47, and 49.
- GitHub Actions validates every change and checks the live website every 15
  minutes. It has timeouts, exponential retry, incident creation, Discord alerts,
  recovery notices, and a guarded rollback after repeated failures. This covers
  9, 10, 18, 19, 25, 43, 48, 50, 53, 54, 63, 64, 65, and 80.
- Git history and Cloudflare deployments provide recoverable versions. The
  rollback is limited to site-only changes and keeps an incident audit trail.
  This covers 13, 34, 55, 56, 58, 59, 60, 73, 78, 79, and 102 for this project.
- The contact form uses HTTPS Web3Forms delivery through a same-origin server
  endpoint, required fields, browser and server validation, honeypot protection,
  timeouts, and inline status feedback. This covers the applicable parts of 7, 8,
  18, 39, and 41.
- Security headers include a strict Content Security Policy, clickjacking
  protection, MIME sniffing protection, referrer controls, restricted browser
  permissions, and HSTS. This covers 31, 32, 33, 74, and 81 through 87 where
  applicable to a static site.
- HTML is semantic, keyboard focus is visible, motion respects reduced-motion
  settings, layouts are responsive, UTF-8 is declared, and images have alternative
  text. This covers 67, 68, 71, 75, 76, and 77.
- Images are compressed and checked against a committed performance budget.
  HTML/CSS/JS revalidate and image cache entries revalidate daily, covering 44.
- Secrets are stored only in GitHub Secrets and never shipped in the website.
  Workflow permissions were reduced to only the access actually used. This covers
  3, 4, 98, and 101 for the caretaker.

## Not applicable to this website

- Database concerns: 11, 12, 36, 37, 38, 45, and 97.
- Login/account concerns: 5, 6, 28, 29, 90 through 96, and 99 through 106 except
  the caretaker secret handling noted above.
- Backend/API architecture: 20, 21, 23, 24, 26, 35, 40, 42, 61, 62, 69, 70,
  84, 86 through 89, and server-only injection/SSRF controls. There is no custom
  backend, command execution, file access, or API surface.
- Database encryption, replication, pooling, normalization, migrations, indexes,
  and soft deletion are not applicable because no visitor data is stored here.

## Owner checks before the final public launch

1. Replace the temporary Web3Forms access key with one linked to
   `cubeinteriorsukl@gmail.com` and confirm it with the client.
2. Add the final custom domain in Cloudflare when the client supplies it, then
   update the sitemap URL and run the live check once more.
3. Keep two-factor authentication enabled on the GitHub and Cloudflare owner
   accounts. This cannot be verified from repository code.
4. Review the privacy wording if analytics, advertising pixels, or additional
   visitor tracking are added later.
