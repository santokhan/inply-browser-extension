import FormParser from "./FormParser";

export default function Parser({ onOpen }) {
  return (
    <section>
      <FormParser onOpen={onOpen} />
    </section>
  );
}
