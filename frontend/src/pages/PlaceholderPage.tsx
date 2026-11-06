function PlaceholderPage({ title }: { title: string }) {
  return (
    <section aria-labelledby="placeholder-heading">
      <h1 id="placeholder-heading" className="text-5xl font-bold leading-none">
        {title}
      </h1>
      <p className="mt-4 text-md text-dark-grey">This page is coming soon.</p>
    </section>
  );
}

export default PlaceholderPage;
