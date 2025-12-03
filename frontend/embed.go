// Package frontend embeds the built frontend assets.
package frontend

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed build/*
var assets embed.FS

// Handler returns an http.Handler that serves the embedded frontend.
// It strips the "build" prefix and serves index.html for SPA routes.
func Handler() http.Handler {
	// Strip the "build" prefix
	sub, err := fs.Sub(assets, "build")
	if err != nil {
		panic(err)
	}

	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		// Check if file exists
		f, err := sub.Open(path[1:]) // Remove leading slash
		if err != nil {
			// File not found, serve index.html for SPA routing
			setCacheHeaders(w, "/index.html")
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}
		f.Close() //nolint:errcheck // Close error not actionable

		setCacheHeaders(w, path)
		fileServer.ServeHTTP(w, r)
	})
}

// setCacheHeaders sets appropriate Cache-Control headers based on the file path.
func setCacheHeaders(w http.ResponseWriter, path string) {
	// SvelteKit puts hashed assets in /_app/immutable/ - cache forever
	if strings.HasPrefix(path, "/_app/immutable/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}

	// HTML files and other mutable assets - short cache with revalidation
	if strings.HasSuffix(path, ".html") || path == "/" {
		w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
		return
	}

	// Other static assets (favicon, etc) - cache for a day
	w.Header().Set("Cache-Control", "public, max-age=86400")
}
