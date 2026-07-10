import { Schema, model } from 'mongoose';

export const ROLES = ['admin', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'staff', index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Expose a clean `id` and never leak Mongo internals or the password hash in JSON.
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    const { _id, passwordHash: _pw, ...rest } = ret;
    return rest;
  },
});

export const User = model('User', userSchema);
