import React from "react";
import { useParams } from "react-router-dom";

type Status = "downloading" | "done";

type Metadata = {
  name: string;
  files: { name: string; path: string }[];
};

type Progress = {
  progress: number;
  speed: string;
  peers: number;
};

export default function Watch() {
  const { hash } = useParams<{ hash: string }>();
  const [status, setStatus] = React.useState<Status>("downloading");
  const [metadata, setMetadata] = React.useState<Metadata | null>(null);
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [subtitleUrl, setSubtitleUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hash) return;

    const es = new EventSource(`/api/watch/${hash}`);

    es.addEventListener("metadata", (e) => {
      setMetadata(JSON.parse(e.data));
    });

    es.addEventListener("progress", (e) => {
      setProgress(JSON.parse(e.data));
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setVideoUrl(data.videoUrl);
      setSubtitleUrl(data.subtitleUrl);
      setStatus("done");
      es.close();
    });

    return () => {
      es.close();
    };
  }, [hash]);

  if (status === "downloading") {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Downloading{metadata ? `: ${metadata.name}` : "..."}</h1>
        {metadata && (
          <div>
            <h3>Files</h3>
            <ul>
              {metadata.files.map((file) => (
                <li key={file.path}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        {progress && (
          <div>
            <div
              style={{
                width: "100%",
                height: "24px",
                background: "#333",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress.progress}%`,
                  height: "100%",
                  background: "#4caf50",
                  transition: "width 0.25s",
                }}
              />
            </div>
            <p>
              {progress.progress}% &middot; {progress.speed} &middot; {progress.peers} peers
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{metadata?.name ?? "Ready"}</h1>
      {videoUrl ? (
        <video controls crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: "80vh" }}>
          <source src={videoUrl} />
          {subtitleUrl && <track src={subtitleUrl} kind="subtitles" srcLang="en" label="English" default />}
        </video>
      ) : (
        <p>No video file found in torrent.</p>
      )}
    </div>
  );
}
