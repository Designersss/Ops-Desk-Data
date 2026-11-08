import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.scss';

export const metadata:Metadata={
 title:'Петро Билдинг Системс — Панель управления',
 description:'Операционная аналитика и управление производственными данными'
};
export default function RootLayout({children}:{children:ReactNode}){
 return <html lang="ru"><body>{children}</body></html>;
}
