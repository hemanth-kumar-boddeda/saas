import React from "react";
import ProductPreview from "./ProductPreview";

const ProductShowcase: React.FC = () => (
  <section id="product" className="cf-scroll-offset py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">Product</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          The whole workspace, in one view
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Files, versions, review notes, approval and publishing details sit next to
          each other. This is the shape of the workspace the build is heading towards.
        </p>
      </div>

      <div className="mt-12">
        <ProductPreview />
      </div>

      <p className="mt-4 caption-3 text-cf-muted">
        The preview shows a sample project with made up content for illustration.
      </p>
    </div>
  </section>
);

export default ProductShowcase;
