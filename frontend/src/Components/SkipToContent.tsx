const SkipToContent = () => {
  return (
    <a
      href="#main-content"
      className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:block focus-visible:h-auto focus-visible:w-auto focus-visible:overflow-visible focus-visible:z-[9999] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-content focus-visible:font-medium focus-visible:shadow-lg"
    >
      Skip to main content
    </a>
  );
};

export default SkipToContent;
