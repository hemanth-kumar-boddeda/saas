import React from "react";
import { styles } from "../styles/style";

type Props = {};

const Policy = (props: Props) => {
  return (
    <div className="pt-20">
      <div className="w-[95%] 800px:w-[92%] m-auto py-2 dark:text-white text-black px-3">
        <h1 className={`${styles.title} !text-start pt-2`}>
          Platform Terms and Condition
        </h1>
        <ul style={{ listStyle: "unset", marginLeft: "15px" }}>
          <p className="py-2 ml-[-15px] text-[16px] font-Poppins leading-8 whitespace-pre-line">
            License Agreement: This license agreement (the “Agreement”) is
            between Vidtouch LLC (“Vidtouch”) and you (“you” or “your”).
            Vidtouch grants you a limited, non-exclusive, non-transferable,
            non-sublicensable license to access and use the Vidtouch
            platform, including any content, materials, and services
            provided on or through the Vidtouch platform. By accessing or
            using the Vidtouch platform, you agree to be bound by this
            Agreement. If you do not agree to be bound by this Agreement, you
            may not access or use the Vidtouch platform.
    
          </p>
          <br />
          <p className="py-2 ml-[-15px] text-[16px] font-Poppins leading-8 whitespace-pre-line">
            Editing Rights: You may edit any content on the Vidtouch platform
            at any time without prior notice. Vidtouch reserves the right to
            remove or edit any content on the Vidtouch platform at any time.
            You may not use any content that is prohibited by law.
            
          </p>
          <br />
          <p className="py-2 ml-[-15px] text-[16px] font-Poppins leading-8 whitespace-pre-line">
            Selecting an editor  for editing : Vidtouch is not responsible for
            the editing of any content on the Vidtouch platform. Vidtouch
            reserves the right to select an editor for editing. Vidtouch
            reserves the right to remove or edit any content on the Vidtouch
            platform at any time.
          </p>
          <br />
         
        </ul>
        <br />
        <br />
      </div>
    </div>
  );
};

export default Policy;
