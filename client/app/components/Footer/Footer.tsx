import React from "react";
import Link from "next/link";

type Props = {};

const Footer = (props: Props) => {
  return (
    <footer>
      <div className="border border-[#0000002d] dark:border-[#ffffff1e] py-4">
        <div className="w-[95%] 800px:w-full 800px:max-w-[85%] mx-auto px-2 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-3">
              <h3 className="text-[20px] font-[600] text-black dark:text-white">
                About
              </h3>
              <ul className="space-y-4">
                <li>
                  <Link
                    href="/about"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Our Story
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-[20px] font-[600] text-black dark:text-white">
                Quick Links
              </h3>
              <ul className="space-y-4">
                <li>
                  <Link
                    href="/videos"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Videos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/profile"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    My Account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/video-dashboard"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Video Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-[20px] font-[600] text-black dark:text-white">
                Social Links
              </h3>
              <ul className="space-y-4">
                <li>
                  <a
                    href="https://www.facebook.com/vidtouch/"
                    target="_blank"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Facebook
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/maahi_1302/"
                    target="_blank"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/hemanth-kumar-boddeda"
                    target="_blank"
                    className="text-base text-black dark:text-gray-300 dark:hover:text-[#ff3377] hover:text-[#37a39a]"
                  >
                    Github
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-[20px] font-[600] text-black dark:text-white">
                Contact Info
              </h3>
              <p className="text-base text-black dark:text-gray-300">
                Call us: +91 7093196823
              </p>
              <p className="text-base text-black dark:text-gray-300">
                Address: Hyderabad, India.
              </p>
              <p className="text-base text-black dark:text-gray-300">
                Mail us: hemanthk.boddeda@gmail.com
              </p>
            </div>
          </div>
          <br />
          <p className="text-center text-black dark:text-white text-[14px]">
            Copyright © 2024 VIDTOUCH | All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
