import { styled } from "styled-components";

export const Page = styled.div`
  padding: 2rem;
`;

export const ProgressBarTrack = styled.div`
  width: 100%;
  height: 24px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
`;

export const ProgressBarFill = styled.div<{ $progress: number }>`
  width: ${(p) => p.$progress}%;
  height: 100%;
  background: #4caf50;
  transition: width 0.25s;
`;

export const Video = styled.video`
  max-width: 100%;
  max-height: 80vh;

  &:focus {
    outline: none;
  }
`;
