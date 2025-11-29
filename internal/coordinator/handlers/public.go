package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/locplace/scanner/internal/coordinator/db"
	"github.com/locplace/scanner/pkg/api"
)

// PublicHandlers contains handlers for public endpoints.
type PublicHandlers struct {
	DB               *db.DB
	HeartbeatTimeout time.Duration
}

// ListRecords handles GET /api/public/records.
func (h *PublicHandlers) ListRecords(w http.ResponseWriter, r *http.Request) {
	limit := parseIntParam(r, "limit", 100)
	offset := parseIntParam(r, "offset", 0)
	domain := r.URL.Query().Get("domain")

	if limit > 1000 {
		limit = 1000
	}

	records, total, err := h.DB.ListLOCRecords(r.Context(), limit, offset, domain)
	if err != nil {
		writeError(w, "failed to list records", http.StatusInternalServerError)
		return
	}

	if records == nil {
		records = []api.PublicLOCRecord{}
	}

	writeJSON(w, http.StatusOK, api.ListRecordsResponse{
		Records: records,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
	})
}

// GetRecordsGeoJSON handles GET /api/public/records.geojson.
// Returns all LOC records as a GeoJSON FeatureCollection.
func (h *PublicHandlers) GetRecordsGeoJSON(w http.ResponseWriter, r *http.Request) {
	records, err := h.DB.GetAllLOCRecordsForGeoJSON(r.Context())
	if err != nil {
		writeError(w, "failed to get records", http.StatusInternalServerError)
		return
	}

	features := make([]api.GeoJSONFeature, 0, len(records))
	for _, rec := range records {
		feature := api.GeoJSONFeature{
			Type: "Feature",
			Geometry: api.GeoJSONPoint{
				Type:        "Point",
				Coordinates: []float64{rec.Longitude, rec.Latitude, rec.AltitudeM},
			},
			Properties: map[string]any{
				"fqdn":         rec.FQDN,
				"root_domain":  rec.RootDomain,
				"raw_record":   rec.RawRecord,
				"altitude_m":   rec.AltitudeM,
				"size_m":       rec.SizeM,
				"horiz_prec_m": rec.HorizPrecM,
				"vert_prec_m":  rec.VertPrecM,
				"first_seen":   rec.FirstSeenAt,
				"last_seen":    rec.LastSeenAt,
			},
		}
		features = append(features, feature)
	}

	fc := api.GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Features: features,
	}

	data, err := json.Marshal(fc)
	if err != nil {
		writeError(w, "failed to encode geojson", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// GetStats handles GET /api/public/stats.
func (h *PublicHandlers) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	domainStats, err := h.DB.GetDomainStats(ctx)
	if err != nil {
		writeError(w, "failed to get domain stats", http.StatusInternalServerError)
		return
	}

	inProgress, err := h.DB.CountInProgressDomains(ctx)
	if err != nil {
		writeError(w, "failed to get in-progress count", http.StatusInternalServerError)
		return
	}

	activeClients, err := h.DB.CountActiveClients(ctx, h.HeartbeatTimeout)
	if err != nil {
		writeError(w, "failed to get active clients", http.StatusInternalServerError)
		return
	}

	locCount, err := h.DB.CountLOCRecords(ctx)
	if err != nil {
		writeError(w, "failed to get LOC record count", http.StatusInternalServerError)
		return
	}

	uniqueWithLOC, err := h.DB.CountUniqueRootDomainsWithLOC(ctx)
	if err != nil {
		writeError(w, "failed to get unique domains with LOC", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, api.StatsResponse{
		TotalRootDomains:         domainStats.Total,
		ScannedRootDomains:       domainStats.Scanned,
		PendingRootDomains:       domainStats.Pending,
		InProgressRootDomains:    inProgress,
		TotalSubdomainsScanned:   domainStats.TotalSubdomainsScanned,
		ActiveScanners:           activeClients,
		TotalLOCRecords:          locCount,
		UniqueRootDomainsWithLOC: uniqueWithLOC,
	})
}

func parseIntParam(r *http.Request, name string, defaultVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 0 {
		return defaultVal
	}
	return v
}
