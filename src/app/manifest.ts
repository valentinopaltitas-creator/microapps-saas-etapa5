import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {return {name:"MicroApps Barberías",short_name:"MicroApps",start_url:"/",display:"standalone",background_color:"#0d0d0f",theme_color:"#0d0d0f",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]};}
