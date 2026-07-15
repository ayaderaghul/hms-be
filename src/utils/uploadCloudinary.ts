import cloudinary from "../cloudinary.js";


export function uploadToCloudinary(
  file: Express.Multer.File,
  type: "image" | "video"
) {

return new Promise<string>((resolve,reject)=>{


 const upload =
 cloudinary.uploader.upload_stream(
 {
   resource_type:type,
   folder:"house-management"
 },

 (error,result)=>{


   if(error){

     console.error(
       "Cloudinary error:",
       error
     );

     reject(error);

   }
   else {

     console.log(
       "Uploaded:",
       result?.secure_url
     );

     resolve(
       result!.secure_url
     );

   }


 });


 upload.end(file.buffer);


});

}