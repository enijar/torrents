import { styled } from "styled-components";

export const Wrapper = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 16px 32px 16px;
`;

export const SearchWrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  background: #1a1a1a;
  padding: 16px 0;
  margin: -16px 0 0 0;
`;

export const SearchBar = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #444;
  border-radius: 8px;
  background: #2a2a2a;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: #888;
  }

  &:focus {
    border-color: #f5c518;
  }
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const Card = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }

  a {
    text-decoration: none;
    color: inherit;
  }
`;

export const Poster = styled.img`
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
  background: #333;
`;

export const CardInfo = styled.div`
  padding: 8px 10px;
`;

export const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: #f5c518;
  margin-bottom: 4px;

  span {
    color: #888;
    margin-left: auto;
  }
`;

export const Title = styled.div`
  font-size: 0.85rem;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const LoadingText = styled.div`
  text-align: center;
  padding: 24px;
  color: #888;
  font-size: 0.9rem;
`;
