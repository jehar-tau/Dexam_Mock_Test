import React from "react";
import { PrivateRasterImage } from "./DrawingInspection.jsx";
export function CommunityImages({ images = [], label }) {
  return images.map((image,index) => <div className="community-image-frame" key={`${image.id}:${image.url}`}>
    <PrivateRasterImage image={image} label={`${label} ${index+1}`} />
  </div>);
}
