FROM nginx:stable-alpine

# Remove default configuration and static files
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom reverse proxy configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add default fallback error page
RUN echo '<!DOCTYPE html><html><head><title>System Initializing</title><meta http-equiv="refresh" content="5"></head><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:#f8fafc;"><h2>OrganMatch Platform is initializing...</h2><p style="color:#94a3b8;">Services are starting up. This page will automatically refresh.</p></body></html>' > /usr/share/nginx/html/50x.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
