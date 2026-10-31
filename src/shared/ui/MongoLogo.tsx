import mongoLeaf from "../../assets/mongodb.webp";

/** MongoDB's leaf: marks a MongoDB server or connection. Decorative (its row already names it). */
export function MongoLogo({ size, className = "" }: { size: number; className?: string }) {
  return <img src={mongoLeaf} width={size} height={size} alt="" aria-hidden draggable={false} className={`mongo-logo ${className}`} />;
}
