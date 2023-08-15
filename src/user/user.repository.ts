import { EntityRepository, Repository } from "typeorm";
import { User } from "./user.entity";
import { UserInfoDto } from "./dto/user-info.dto";
import { NotFoundException } from "@nestjs/common";
import { bookMarksDTO } from "./dto/book-marks.dto";
import { UpdatedUserThumbnailDto } from "./dto/updated-user-thumbnail.dto";

@EntityRepository(User)
export class UserRepository extends Repository<User> {
    
    async getUserInfo(email: string): Promise<UserInfoDto> {
        
        const user = await this.findOne({ email });

        if (user) {
            const { email, username, thumbnail, bookMarks, statusMessage } = user;
            return { email, username, thumbnail, bookMarks, statusMessage };
        } else {
            throw new NotFoundException(`User not found.`);
        }
    }

    async postBookMark(email: string, postId: number): Promise<bookMarksDTO> {
        const user = await this.findOne({ email });
    
        if (!user) {
          throw new Error('User not found');
        }
    
        var { bookMarks } = user;

        // If it was previously bookmarked, cancel the bookmark
        if (bookMarks.includes(postId)) {
            bookMarks = bookMarks.filter((id) => id !== postId);
        }
        // If it hadn't been bookmarked yet, proceed with bookmarking.
        else {
            bookMarks.push(postId);
        }
        user.bookMarks = bookMarks;
        await this.save(user)
    
        return { bookMarks };
    }
    
    async updateUserThumbnail(email: string, newThumbnailUrl: string): Promise<UpdatedUserThumbnailDto> {
        const user = await this.findOne({ email });
    
        if (!user) {
          throw new Error('User not found');
        }
    
        user.thumbnail = newThumbnailUrl;
        await this.save(user)

        const updatedUserThumbnailDto = new UpdatedUserThumbnailDto();
        updatedUserThumbnailDto.updatedThumbnail = user.thumbnail;
    
        return updatedUserThumbnailDto;
    }
    
    async updateStatusMessage(
        email: string,
        newStatusMessage: string,
    ): Promise<void> {
        const user = await this.findOne({ email });
    
        if (user) {
            /// Update user status message
            user.statusMessage = newStatusMessage;
            await this.save(user);

        } else {
            throw new NotFoundException(`User not found`);
        }
    }

}