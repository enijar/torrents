import React from "react";
import { useParams } from "react-router-dom";
import * as Style from "client/pages/watch/watch.style.js";

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
      <Style.Page>
        <h1>Downloading{metadata ? `: ${metadata.name}` : "..."}</h1>
        {metadata && (
          <div>
            <h3>Files</h3>
            <ul>
              {metadata.files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        {progress && (
          <div>
            <Style.ProgressBarTrack>
              <Style.ProgressBarFill $progress={progress.progress} />
            </Style.ProgressBarTrack>
            <p>
              {progress.progress}% &middot; {progress.speed} &middot; {progress.peers} peers
            </p>
          </div>
        )}
      </Style.Page>
    );
  }

  return (
    <Style.Page>
      <h1>{metadata?.name ?? "Ready"}</h1>
      {videoUrl ? (
        <Style.Video autoPlay controls crossOrigin="anonymous">
          <source src={videoUrl} />
          {subtitleUrl && <track src={subtitleUrl} kind="subtitles" srcLang="en" label="English" default />}
        </Style.Video>
      ) : (
        <p>No video file found in torrent.</p>
      )}
    </Style.Page>
  );
}
