import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { PrismaService } from '@src/prisma/prisma.service';
import { BydateDto } from './dto';
import { Book, BookRoomDto } from './dto/bookRoom.dto';
import { ByRangeDateDto } from './dto/getByRangeDate.dto';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}
  async getAvailableRoomByDate(date: string): Promise<any> {
    const datecheck = new Date(date + ' 8:00:00');
    await this.prisma.room.findMany({ include: { bookList: true } });
    const listBookings: Book[] = await this.prisma.$queryRaw`SELECT * 
    FROM Bookings
    WHERE ${datecheck} between startDate and endDate`;
    const listId = listBookings.map((item) => item.id);
    const rooms = await this.prisma.room.findMany({
      include: { bookList: true },
    });
    const listIdBooked = new Array();
    listId.map((id) => {
      rooms.map((item) => {
        item.bookList.map((itm) => {
          if (itm.id == id && itm.status == 4) {
            listIdBooked.push(item.id);
          }
        });
      });
    });
    const listRoom = await this.prisma.room.findMany();
    listIdBooked.map((id) => {
      this.removeObjectWithId(listRoom, id);
    });
    return listRoom;
  }
  
  async getAvailableRoomByRange( byRangeDateDto:ByRangeDateDto): Promise<any> {
    const startDatecheck = new Date(byRangeDateDto.startDate + ' 00:00:00');
    const endDatecheck = new Date(byRangeDateDto.endDate + ' 23:59:00');
    const startDatecheckString=`"${this.formatDate(startDatecheck)}"`
    const startendDatecheck=`"${this.formatDate(endDatecheck)}"`
    await this.prisma.room.findMany({ include: { bookList: true } });
    const query =`SELECT * 
    FROM Bookings
    WHERE(${startDatecheckString} between startDate and endDate) OR
    ( ${startendDatecheck} between startDate and endDate) OR
    (${startDatecheckString} <= startDate AND ${startendDatecheck} >= endDate)`;
    const listBookings: Book[] = await this.prisma.$queryRawUnsafe(query);
    const listId = listBookings.map((item) => item.id);
    const rooms = await this.prisma.room.findMany({
      include: { bookList: true },
    });
    const listIdBooked = new Array();
    listId.map((id) => {
      rooms.map((item) => {
        item.bookList.map((itm) => {
          if (itm.id == id && itm.status == 4) {
            listIdBooked.push(item.id);
          }
        });
      });
    });
    const listRoom = await this.prisma.room.findMany();
    listIdBooked.map((id) => {
      this.removeObjectWithId(listRoom, id);
    });
    return listRoom;
  }
  removeObjectWithId(arr: any[], id: number) {
    const objWithIdIndex = arr.findIndex((obj) => obj.id === id);
    arr.splice(objWithIdIndex, 1);
    return arr;
  }
   padTo2Digits(num:number) {
    return num.toString().padStart(2, '0');
  }
   formatDate(date:Date) {
    return (
      [
        date.getFullYear(),
        this.padTo2Digits(date.getMonth() + 1),
        this.padTo2Digits(date.getDate()),
      ].join('-') +
      ' ' +
      [
        this.padTo2Digits(date.getHours()),
        this.padTo2Digits(date.getMinutes()),
        this.padTo2Digits(date.getSeconds()),
      ].join(':')
    );
  }
  async cancelBooking(idBooking: number, userId: number) {
    const checkExist = await this.prisma.booking.findMany({
      where: {
        id: Number(idBooking),
        user: {
          id: userId,
        },
      },
    });
    if (checkExist.length == 0) {
      return { message: 'Booking not exist !' };
    }
    await this.prisma.booking.update({
      where: {
        id: Number(idBooking),
      },
      data: {
        status: 2,
      },
    });
    return { message: 'Cancel Success !' };
  }
  async editBooking(
    idBooking: number,
    userId: number,
    bookRoomDto: BookRoomDto,
  ) {
    const checkExist = await this.prisma.booking.findMany({
      where: {
        id: Number(idBooking),
        user: {
          id: userId,
        },
      },
    });
    if (checkExist.length == 0) {
      return { message: 'Booking not exist !' };
    }
    // const rooms = bookRoomDto.roomIds?.map((room) => ({
    //   id: Number(room),
    // }));
    const checkDate = new Date();
    const startDate = new Date(bookRoomDto.startDate);
    if (checkDate.toISOString() > startDate.toISOString()) {
      throw new ForbiddenException('Time exp !');
    }
    const endDate = new Date(bookRoomDto.endDate + ' 23:00:00');
    await this.prisma.booking.update({
      where: {
        id: Number(idBooking),
      },
      data: {
        startDate: startDate,
        endDate: endDate,
        status: Number(bookRoomDto.status),
        user: {
          connect: {
            id: Number(bookRoomDto.userId),
          },
        },
      },
    });
    return { message: 'Update Success !' };
  }
  async bookRoom(bookRoomDto: BookRoomDto): Promise<any> {
    const rooms = bookRoomDto.roomIds?.map((room) => ({
      id: Number(room),
    }));
    const startDate = new Date(bookRoomDto.startDate);
    const endDate = new Date(bookRoomDto.endDate + ' 23:00:00');
    return this.prisma.booking
      .create({
        data: {
          startDate: startDate,
          endDate: endDate,
          status: Number(bookRoomDto.status),
          user: {
            connect: {
              id: Number(bookRoomDto.userId),
            },
          },
          room: {
            connect: rooms,
          },
        },
        include: {
          room: true,
        },
      })
      .catch((error) => {
        if (error instanceof PrismaClientKnownRequestError) {
          console.log(error.code);
          if (error.code === 'P2025') {
            throw new ForbiddenException('Id rooms not exist !');
          }
        }
        throw error;
      });
  }
}
