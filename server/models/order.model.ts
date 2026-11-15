import mongoose, { Schema, Document, Model } from "mongoose";
import { IUser } from "./user.model";

export interface IOrder extends Document {
    videoId: string;
    userId: string;
    payment_info: Object;
}

const orderSchema = new Schema<IOrder>({
    videoId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    payment_info: {
        type: Object,
    },
}, {
    timestamps: true
});

const OrderModel = mongoose.model<IOrder>("Order", orderSchema);

export default OrderModel;