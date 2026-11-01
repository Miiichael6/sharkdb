import { labelSegments, matchName } from "../domain/collectionFilter";

interface Props {
  label: string;
  query: string;
}

/** `label` with the parts matching the filter `query` highlighted. */
export function HighlightedLabel({ label, query }: Props) {
  const ranges = matchName(label, query) ?? [];
  return (
    <>
      {labelSegments(label, ranges).map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : s.text))}
    </>
  );
}
