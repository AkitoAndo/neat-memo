export default function ImageItemComponent({ item }) {
  return (
    <div className="image-container">
      <img src={item.src} alt="画像" draggable={false} />
    </div>
  );
}
