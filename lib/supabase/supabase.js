// Supabase client initialization
const supabaseUrl = "https://scbzbffwuovxqlnmgvxb.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnpiZmZ3dW92eHFsbm1ndnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyOTAwNTAsImV4cCI6MjA1Mzg2NjA1MH0.eRNLhMojEXbgAO9PXbk6yjZMA34e0aJiOQzJPBDL3fc";

// Create Supabase client and expose it globally
window.supabase = {
  createClient: (url, key) => {
    return {
      storage: {
        from: (bucket) => ({
          upload: async (path, file, options) => {
            try {
              // Create FormData
              const formData = new FormData();
              formData.append("file", file);

              // Make the upload request
              const response = await fetch(
                `${url}/storage/v1/object/${bucket}/${path}`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${key}`,
                    // Include apikey header for anonymous access
                    apikey: key,
                    // Set cache control if provided in options
                    ...(options?.cacheControl && {
                      "x-upsert": "true",
                      "cache-control": options.cacheControl,
                    }),
                  },
                  body: formData,
                }
              );

              const data = await response.json();

              if (!response.ok) {
                console.error("Upload error:", data);
                return { data: null, error: data };
              }

              return { data, error: null };
            } catch (error) {
              console.error("Upload error:", error);
              return { data: null, error };
            }
          },
          getPublicUrl: (path) => ({
            data: {
              publicUrl: `${url}/storage/v1/object/public/${bucket}/${path}`,
            },
          }),
        }),
      },
    };
  },
};

console.log("Supabase library loaded locally");
