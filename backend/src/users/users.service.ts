import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  findByEmailWithPasswordHash(email: string) {
    return this.userModel.findOne({ email }).select('+password_hash');
  }

  findByIdForMFA(userId: string) {
    return this.userModel.findOne({ id: userId }).select('+mfa_secret');
  }

  create(
    email: string,
    password_hash: string,
    name: string,
    role: string = 'user',
  ) {
    return this.userModel.create({
      email,
      password_hash,
      name,
      is_active: true,
      roles: [role],
    });
  }

  async findOrCreateOAuthUser(data: {
    email: string;
    provider: string;
    providerId: string;
    name: string;
  }) {
    let user = await this.userModel.findOne({ email: data.email });
    if (!user) {
      user = await this.userModel.create({
        email: data.email,
        provider: data.provider,
        providerId: data.providerId,
        roles: ['user'],
        name: data.name,
      });
    }
    return user;
  }

  updateOne(filter: any, update: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.userModel.updateOne(filter, update);
  }

  findOne(filter: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.userModel.findOne(filter);
  }
}
