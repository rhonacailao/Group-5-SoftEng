function OrDivider() {
  return (
    <div role="separator" aria-label="or" className="flex items-center gap-4 text-dark-grey">
      <span className="h-px flex-1 bg-light-grey" />
      <span>Or</span>
      <span className="h-px flex-1 bg-light-grey" />
    </div>
  );
}

export default OrDivider;
