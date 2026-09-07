FROM nginx:stable-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/nginx.conf

# Create standard fallback index directory
RUN mkdir -p /usr/share/nginx/html

# Copy temporary fallback HTML page for development
RUN echo "<h1>Organ Donation Portal (Front-end build target)</h1>" > /usr/share/nginx/html/index.html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
