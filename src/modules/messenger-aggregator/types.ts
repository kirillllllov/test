export interface Actions {
    user_id: string;
    place: {
        chat_id: string;
    };
    action: string;
    date_time: Date;
}

export interface BaseInf{
    user_id: string;

}

export interface Commands{
    user_id:	string
    button:	string
    place:{
        chat_id: string,
    }
    name: string,
    date_time:	Date
}

export interface messageImage{
    user_id:	string
    button:	string
    place:{
        chat_id: string,
    }
  attachments_base64: [string],
  date_time:	Date
}
export interface InputKeyboard{
    user_id:	string
    button:	string
    place:{
        chat_id: string,
        message_id: string,
    }
    date_time:	Date
}


export interface userMessage{
    user_id:	string
    button:	string
    place:{
        chat_id: string,
    }
    date_time:	Date
    text: string,
}