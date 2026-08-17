import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketPriority, TicketStatus } from './ticket.entity';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() body: Record<string, unknown>, @Headers('x-actor') actor = 'api') {
    return this.ticketsService.create(actor, body as never);
  }

  @Get()
  findAll(
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
  ) {
    return this.ticketsService.findAll({ status, priority });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Post(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() body: { to?: string },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.changeStatus(actor, id, body?.to);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body()
    body: {
      author?: string;
      body?: string;
      internal?: boolean;
      cannedResponseId?: string;
    },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.addComment(actor, id, body ?? {});
  }

  @Post(':id/tags')
  addTag(
    @Param('id') id: string,
    @Body() body: { name?: string },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.addTag(actor, id, body?.name);
  }

  @Delete(':id/tags/:name')
  removeTag(
    @Param('id') id: string,
    @Param('name') name: string,
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.removeTag(actor, id, name);
  }
}
