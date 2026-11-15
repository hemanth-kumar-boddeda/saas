import { useGetVideoDetailsQuery } from "@/redux/features/videos/videosApi";
import React, { useState, useEffect } from "react";
import Loader from "../Loader/Loader";
import Heading from "@/app/utils/Heading";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import VideoDetails from "../Videos/VideoDetails";
import {
  useCreatePaymentIntentMutation,
  useGetStripePublishableKeyQuery} from "@/redux/features/orders/ordersApi";
import { loadStripe } from "@stripe/stripe-js";

type Props = {
  id: string;
};

const VideoDetailsPage = ({ id }: Props) => {
  const [route, setRoute] = useState("Login");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGetVideoDetailsQuery(id);
  const { data: config } = useGetStripePublishableKeyQuery({});
  const [createPaymentIntent, { data: paymentIntentData }] =
    useCreatePaymentIntentMutation();
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (config) {
      const publishableKey = config?.publishableKey;
      setStripePromise(loadStripe(publishableKey));
    }
    if (data) {
      const amount = Math.round(data.course.price * 100);
      createPaymentIntent(amount);
    }
  }, [config, data, createPaymentIntent]);

  useEffect(() => {
    if (paymentIntentData) {
      setClientSecret(paymentIntentData?.client_secret);
    }
  }, [paymentIntentData]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <div>
          <Heading
            title={data.video.name + " - VIDTOUCH"}
            description={
              "VIDTOUCH is an online learning and teaching marketplace with over 213000 courses and 62 million students. Learn programming, marketing, data science and more."
            }
            keywords={data?.video?.tags}
          />
          <Navbar
            open={open}
            setOpen={setOpen}
            route={route}
            setRoute={setRoute}
          />
          {stripePromise && (
            <VideoDetails
              data={data.video}
              stripePromise={stripePromise}
              clientSecret={clientSecret}
              setOpen={setOpen}
              setRoute={setRoute}
            />
          )}
          <Footer />
        </div>
      )}
    </>
  );
};

export default VideoDetailsPage;
