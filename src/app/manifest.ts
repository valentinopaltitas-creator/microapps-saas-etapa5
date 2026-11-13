import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {return {name:"MicroApps Barberías",short_name:"MicroApps",start_url:"/",display:"standalone",background_color:"#f7f4eb",theme_color:"#103e32",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]};}
